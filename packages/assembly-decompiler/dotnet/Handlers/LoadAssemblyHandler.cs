using System.Reflection.Metadata;
using System.Text.Json;
using AssemblyBackend;
using ICSharpCode.Decompiler;
using ICSharpCode.Decompiler.CSharp;
using ICSharpCode.Decompiler.Metadata;

namespace DataverseAssemblyDecompiler.Handlers;

public class LoadAssemblyHandler : ICommandHandler
{
    public string Name => "loadAssembly";

    public Task<object?> HandleAsync(JsonElement? parameters, IAssemblyManager manager)
    {
        var assemblyId = parameters?.GetStringProp("assemblyId");
        var base64 = parameters?.GetStringProp("base64");

        if (string.IsNullOrEmpty(assemblyId) || string.IsNullOrEmpty(base64))
        {
            throw new ArgumentException("assemblyId and base64 are required");
        }

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64);
        }
        catch (FormatException)
        {
            throw new ArgumentException("Failed to decode base64 content");
        }

        // Store raw bytes via assembly manager
        var loaded = manager.LoadFromBytes(assemblyId, bytes);

        // Set up ILSpy decompiler state
        var stream = new MemoryStream(bytes);
        PEFile peFile;
        try
        {
            peFile = new PEFile("assembly.dll", stream);
        }
        catch (Exception ex)
        {
            stream.Dispose();
            manager.Unload(assemblyId);
            throw new InvalidOperationException($"Failed to load PE file: {ex.Message}", ex);
        }

        var resolver = new UniversalAssemblyResolver(
            mainAssemblyFileName: null,
            throwOnError: false,
            targetFramework: peFile.DetectTargetFrameworkId()
        );

        var decompiler = new CSharpDecompiler(peFile, resolver, new DecompilerSettings(LanguageVersion.CSharp11_0)
        {
            ThrowOnAssemblyResolveErrors = false,
        });

        var state = new DecompilerState
        {
            PeFile = peFile,
            Decompiler = decompiler,
            Resolver = resolver,
        };

        loaded.Extensions["decompiler"] = state;

        // Collect namespaces and type counts
        var namespaces = new Dictionary<string, int>();
        foreach (var typeHandle in peFile.Metadata.TypeDefinitions)
        {
            var typeDef = peFile.Metadata.GetTypeDefinition(typeHandle);
            var ns = peFile.Metadata.GetString(typeDef.Namespace);
            var name = peFile.Metadata.GetString(typeDef.Name);

            if (string.IsNullOrEmpty(name) || name.StartsWith("<"))
            {
                continue;
            }

            if (typeDef.IsNested)
            {
                continue;
            }

            if (string.IsNullOrEmpty(ns))
            {
                ns = "(global)";
            }

            namespaces[ns] = namespaces.GetValueOrDefault(ns) + 1;
        }

        return Task.FromResult<object?>(new
        {
            assemblyId,
            namespaces = namespaces.Keys.OrderBy(n => n).ToList(),
            typeCount = namespaces.Values.Sum(),
        });
    }
}
