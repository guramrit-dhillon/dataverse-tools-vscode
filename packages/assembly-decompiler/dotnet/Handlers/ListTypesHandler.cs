using System.Reflection;
using System.Reflection.Metadata;
using System.Text.Json;
using AssemblyBackend;

namespace DataverseAssemblyDecompiler.Handlers;

public class ListTypesHandler : ICommandHandler
{
    public string Name => "listTypes";

    public Task<object?> HandleAsync(JsonElement? parameters, IAssemblyManager manager)
    {
        var assemblyId = parameters?.GetStringProp("assemblyId");
        var ns = parameters?.GetStringProp("namespace");

        if (string.IsNullOrEmpty(assemblyId))
        {
            throw new ArgumentException("assemblyId is required");
        }

        if (ns is null)
        {
            throw new ArgumentException("namespace is required");
        }

        var loaded = manager.Get(assemblyId)
            ?? throw new InvalidOperationException("Assembly not loaded");

        if (!loaded.Extensions.TryGetValue("decompiler", out var ext) || ext is not DecompilerState state)
        {
            throw new InvalidOperationException("Assembly not loaded with decompiler support");
        }

        var types = new List<TypeListEntry>();
        foreach (var typeHandle in state.PeFile.Metadata.TypeDefinitions)
        {
            var typeDef = state.PeFile.Metadata.GetTypeDefinition(typeHandle);
            var typeName = state.PeFile.Metadata.GetString(typeDef.Name);
            var typeNs = state.PeFile.Metadata.GetString(typeDef.Namespace);

            if (string.IsNullOrEmpty(typeName) || typeName.StartsWith("<") || typeDef.IsNested)
            {
                continue;
            }

            var effectiveNs = string.IsNullOrEmpty(typeNs) ? "(global)" : typeNs;
            if (effectiveNs != ns)
            {
                continue;
            }

            var fullName = string.IsNullOrEmpty(typeNs) ? typeName : $"{typeNs}.{typeName}";

            var kind = "class";
            if ((typeDef.Attributes & TypeAttributes.Interface) != 0)
            {
                kind = "interface";
            }
            else if ((typeDef.Attributes & TypeAttributes.Sealed) != 0
                     && (typeDef.Attributes & TypeAttributes.Abstract) != 0)
            {
                kind = "static";
            }
            else if (IsEnum(state.PeFile.Metadata, typeDef))
            {
                kind = "enum";
            }
            else if (IsValueType(state.PeFile.Metadata, typeDef))
            {
                kind = "struct";
            }

            types.Add(new TypeListEntry
            {
                FullName = fullName,
                Name = typeName,
                Kind = kind,
            });
        }

        types.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.Ordinal));

        return Task.FromResult<object?>(new
        {
            assemblyId,
            @namespace = ns,
            types,
        });
    }

    private static bool IsEnum(MetadataReader metadata, TypeDefinition typeDef)
    {
        if (typeDef.BaseType.IsNil) return false;
        return GetBaseTypeName(metadata, typeDef.BaseType) == "System.Enum";
    }

    private static bool IsValueType(MetadataReader metadata, TypeDefinition typeDef)
    {
        if (typeDef.BaseType.IsNil) return false;
        return GetBaseTypeName(metadata, typeDef.BaseType) == "System.ValueType";
    }

    private static string? GetBaseTypeName(MetadataReader metadata, EntityHandle baseType)
    {
        if (baseType.Kind == HandleKind.TypeReference)
        {
            var typeRef = metadata.GetTypeReference((TypeReferenceHandle)baseType);
            var ns = metadata.GetString(typeRef.Namespace);
            var name = metadata.GetString(typeRef.Name);
            return string.IsNullOrEmpty(ns) ? name : $"{ns}.{name}";
        }
        if (baseType.Kind == HandleKind.TypeDefinition)
        {
            var td = metadata.GetTypeDefinition((TypeDefinitionHandle)baseType);
            var ns = metadata.GetString(td.Namespace);
            var name = metadata.GetString(td.Name);
            return string.IsNullOrEmpty(ns) ? name : $"{ns}.{name}";
        }
        return null;
    }
}

record TypeListEntry
{
    public string FullName { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Kind { get; init; } = string.Empty;
}
