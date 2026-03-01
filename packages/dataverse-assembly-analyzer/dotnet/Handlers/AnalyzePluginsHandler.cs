using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Security.Cryptography;
using System.Text.Json;
using AssemblyBackend;

namespace DataversePluginAnalyzer.Handlers;

public class AnalyzePluginsHandler : ICommandHandler
{
    public string Name => "analyzePlugins";

    public Task<object?> HandleAsync(JsonElement? parameters, IAssemblyManager manager)
    {
        var assemblyPath = parameters?.GetStringProp("assemblyPath");
        var resolverPaths = parameters?.GetStringArrayProp("resolverPaths");

        if (string.IsNullOrEmpty(assemblyPath))
        {
            throw new ArgumentException("assemblyPath is required");
        }

        if (!File.Exists(assemblyPath))
        {
            throw new FileNotFoundException($"Assembly not found: {assemblyPath}");
        }

        var result = AnalyzeAssembly(assemblyPath, resolverPaths, manager);
        return Task.FromResult<object?>(result);
    }

    private static AssemblyAnalysisResult AnalyzeAssembly(
        string assemblyPath,
        string[]? resolverPaths,
        IAssemblyManager manager)
    {
        var fileHash = ComputeHash(assemblyPath);

        // Use the shared AssemblyManager to load with MetadataLoadContext
        var assemblyId = $"analyzer-{Guid.NewGuid():N}";
        var loaded = manager.LoadFromPath(assemblyId, assemblyPath, resolverPaths);

        try
        {
            var assembly = loaded.MetadataAssembly
                ?? throw new InvalidOperationException("MetadataAssembly not available");
            var assemblyName = assembly.GetName();

            var types = GetLoadableTypes(assembly);

            // Pre-compute activity type names using PE metadata (no dependency resolution)
            var activityTypeNames = FindActivityTypes(assemblyPath);

            var plugins = new List<PluginTypeInfo>();
            foreach (var t in types)
            {
                if (t.IsAbstract || t.IsInterface || !t.IsPublic) { continue; }

                string? kind = null;
                if (ImplementsInterface(t, "Microsoft.Xrm.Sdk.IPlugin"))
                {
                    kind = "plugin";
                }
                else if (t.FullName is not null && activityTypeNames.Contains(t.FullName))
                {
                    kind = "activity";
                }

                if (kind is null) { continue; }

                var info = AnalyzeType(t);
                plugins.Add(info with { Kind = kind });
            }

            return new AssemblyAnalysisResult
            {
                AssemblyName = assemblyName.Name ?? Path.GetFileNameWithoutExtension(assemblyPath),
                Version = assemblyName.Version?.ToString() ?? "0.0.0.0",
                Culture = string.IsNullOrEmpty(assemblyName.CultureName) ? "neutral" : assemblyName.CultureName,
                PublicKeyToken = FormatPublicKeyToken(assemblyName.GetPublicKeyToken()),
                FilePath = assemblyPath,
                FileHash = fileHash,
                Plugins = plugins,
                AnalyzerVersion = typeof(AssemblyAnalysisResult).Assembly.GetName().Version?.ToString() ?? "1.0.0",
                AnalyzedAt = DateTime.UtcNow.ToString("O"),
            };
        }
        finally
        {
            manager.Unload(assemblyId);
        }
    }

    /// <summary>
    /// Safely enumerate types from an assembly. Some types may fail to load when
    /// transitive dependencies are missing (e.g. System.Activities in .NET Framework
    /// assemblies). We catch ReflectionTypeLoadException and return the types that
    /// did load successfully.
    /// </summary>
    private static Type[] GetLoadableTypes(Assembly assembly)
    {
        try
        {
            return assembly.GetTypes();
        }
        catch (ReflectionTypeLoadException ex)
        {
            return ex.Types.Where(t => t is not null).ToArray()!;
        }
    }

    private static readonly HashSet<string> WorkflowActivityBaseClasses =
    [
        "System.Activities.CodeActivity",
        "System.Activities.NativeActivity",
        "Microsoft.Xrm.Sdk.Workflow.CodeActivity",
    ];

    /// <summary>
    /// Uses raw PE metadata to find types that extend workflow activity base classes.
    /// Walks the base type chain without resolving external assemblies — reads TypeRef
    /// names directly from metadata, so missing DLLs (e.g. System.Activities) are fine.
    /// </summary>
    private static HashSet<string> FindActivityTypes(string assemblyPath)
    {
        var result = new HashSet<string>();
        try
        {
            using var stream = File.OpenRead(assemblyPath);
            using var peReader = new PEReader(stream);
            var metadata = peReader.GetMetadataReader();

            // Build lookup: TypeDefinitionHandle → full name (for same-assembly base types)
            var typeNames = new Dictionary<TypeDefinitionHandle, string>();
            foreach (var handle in metadata.TypeDefinitions)
            {
                var td = metadata.GetTypeDefinition(handle);
                if (td.IsNested) { continue; }
                var ns = metadata.GetString(td.Namespace);
                var name = metadata.GetString(td.Name);
                var fullName = string.IsNullOrEmpty(ns) ? name : $"{ns}.{name}";
                typeNames[handle] = fullName;
            }

            // Check each type's base type chain
            foreach (var handle in metadata.TypeDefinitions)
            {
                if (ExtendsActivityByMetadata(metadata, handle, typeNames))
                {
                    if (typeNames.TryGetValue(handle, out var name))
                    {
                        result.Add(name);
                    }
                }
            }
        }
        catch { /* PE read failure — return empty set */ }
        return result;
    }

    private static bool ExtendsActivityByMetadata(
        MetadataReader metadata,
        TypeDefinitionHandle typeHandle,
        Dictionary<TypeDefinitionHandle, string> typeNames)
    {
        var visited = new HashSet<TypeDefinitionHandle>();
        var current = metadata.GetTypeDefinition(typeHandle).BaseType;

        while (!current.IsNil)
        {
            if (current.Kind == HandleKind.TypeReference)
            {
                // External assembly — read name without resolving
                var typeRef = metadata.GetTypeReference((TypeReferenceHandle)current);
                var ns = metadata.GetString(typeRef.Namespace);
                var name = metadata.GetString(typeRef.Name);
                var fullName = string.IsNullOrEmpty(ns) ? name : $"{ns}.{name}";
                return WorkflowActivityBaseClasses.Contains(fullName);
            }

            if (current.Kind == HandleKind.TypeDefinition)
            {
                var defHandle = (TypeDefinitionHandle)current;
                if (!visited.Add(defHandle)) { break; } // cycle guard

                // Same-assembly type — check name then continue walking
                if (typeNames.TryGetValue(defHandle, out var fullName)
                    && WorkflowActivityBaseClasses.Contains(fullName))
                {
                    return true;
                }

                current = metadata.GetTypeDefinition(defHandle).BaseType;
                continue;
            }

            break; // TypeSpec or unknown — stop
        }

        return false;
    }

    private static bool ImplementsInterface(Type type, string interfaceFullName)
    {
        try
        {
            return type.GetInterfaces().Any(i => i.FullName == interfaceFullName)
                || (type.BaseType is not null && ImplementsInterface(type.BaseType, interfaceFullName));
        }
        catch (FileNotFoundException)
        {
            // Dependency assembly not available — skip this type
            return false;
        }
        catch (FileLoadException)
        {
            return false;
        }
    }

    private static PluginTypeInfo AnalyzeType(Type type)
    {
        var constructors = type.GetConstructors(BindingFlags.Public | BindingFlags.Instance)
            .Select(c => new ConstructorDetail
            {
                Parameters = c.GetParameters()
                    .Select(p => new ParameterDetail
                    {
                        Name = p.Name ?? "param",
                        Type = p.ParameterType.FullName ?? p.ParameterType.Name,
                    })
                    .ToList(),
            })
            .ToList();

        var attributes = type.CustomAttributes
            .Select(a => new CustomAttributeDetail
            {
                TypeName = a.AttributeType.FullName ?? a.AttributeType.Name,
                Arguments = a.ConstructorArguments
                    .Select(ca => new AttributeArgumentDetail { Value = ca.Value?.ToString() })
                    .Concat(a.NamedArguments.Select(na => new AttributeArgumentDetail
                    {
                        Name = na.MemberName,
                        Value = na.TypedValue.Value?.ToString(),
                    }))
                    .ToList(),
            })
            .ToList();

        var registrationHints = ExtractRegistrationHints(attributes);

        return new PluginTypeInfo
        {
            FullName = type.FullName ?? type.Name,
            Namespace = type.Namespace ?? string.Empty,
            ClassName = type.Name,
            Constructors = constructors,
            Attributes = attributes,
            RegistrationHints = registrationHints,
        };
    }

    private static List<RegistrationHint> ExtractRegistrationHints(List<CustomAttributeDetail> attributes)
    {
        const string attrName = "Microsoft.Xrm.Sdk.Client.CrmPluginRegistrationAttribute";
        var hints = new List<RegistrationHint>();

        foreach (var attr in attributes.Where(a => a.TypeName == attrName))
        {
            var positional = attr.Arguments.Where(a => a.Name is null).ToList();
            if (positional.Count < 4) { continue; }

            var hint = new RegistrationHint
            {
                MessageName = positional[0].Value ?? string.Empty,
                PrimaryEntityName = positional[1].Value ?? string.Empty,
                Stage = int.TryParse(positional[2].Value, out var stage) ? stage : 40,
                Mode = int.TryParse(positional[3].Value, out var mode) ? mode : 0,
                Rank = positional.Count > 4 && int.TryParse(positional[4].Value, out var rank) ? rank : 1,
            };

            var named = attr.Arguments.Where(a => a.Name is not null).ToDictionary(a => a.Name!, a => a.Value);
            hint.FilteringAttributes = named.GetValueOrDefault("FilteringAttributes");
            hint.UnsecureConfig = named.GetValueOrDefault("UnsecureConfiguration");
            hint.Description = named.GetValueOrDefault("Description");

            hints.Add(hint);
        }

        return hints;
    }

    private static string ComputeHash(string path)
    {
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(path);
        var bytes = sha256.ComputeHash(stream);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string FormatPublicKeyToken(byte[]? token)
    {
        if (token is null || token.Length == 0) { return "null"; }
        return Convert.ToHexString(token).ToLowerInvariant();
    }
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

record AssemblyAnalysisResult
{
    public string AssemblyName { get; init; } = string.Empty;
    public string Version { get; init; } = string.Empty;
    public string Culture { get; init; } = string.Empty;
    public string PublicKeyToken { get; init; } = string.Empty;
    public string FilePath { get; init; } = string.Empty;
    public string FileHash { get; init; } = string.Empty;
    public List<PluginTypeInfo> Plugins { get; init; } = [];
    public string AnalyzerVersion { get; init; } = string.Empty;
    public string AnalyzedAt { get; init; } = string.Empty;
}

record PluginTypeInfo
{
    public string FullName { get; init; } = string.Empty;
    public string Namespace { get; init; } = string.Empty;
    public string ClassName { get; init; } = string.Empty;
    public string Kind { get; init; } = "plugin";
    public List<ConstructorDetail> Constructors { get; init; } = [];
    public List<CustomAttributeDetail> Attributes { get; init; } = [];
    public List<RegistrationHint> RegistrationHints { get; init; } = [];
}

record ConstructorDetail
{
    public List<ParameterDetail> Parameters { get; init; } = [];
}

record ParameterDetail
{
    public string Name { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
}

record CustomAttributeDetail
{
    public string TypeName { get; init; } = string.Empty;
    public List<AttributeArgumentDetail> Arguments { get; init; } = [];
}

record AttributeArgumentDetail
{
    public string? Name { get; init; }
    public string? Value { get; init; }
}

record RegistrationHint
{
    public string MessageName { get; init; } = string.Empty;
    public string PrimaryEntityName { get; init; } = string.Empty;
    public int Stage { get; init; }
    public int Mode { get; init; }
    public int Rank { get; init; } = 1;
    public string? FilteringAttributes { get; set; }
    public string? UnsecureConfig { get; set; }
    public string? Description { get; set; }
    public List<ImageHint> Images { get; init; } = [];
}

record ImageHint
{
    public int ImageType { get; init; }
    public string EntityAlias { get; init; } = string.Empty;
    public string? Attributes { get; init; }
    public string MessagePropertyName { get; init; } = "Target";
}
