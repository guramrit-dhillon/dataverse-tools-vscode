using System.Text.Json;
using AssemblyBackend;

namespace DataverseAssemblyDecompiler.Handlers;

public class ListNamespacesHandler : ICommandHandler
{
    public string Name => "listNamespaces";

    public Task<object?> HandleAsync(JsonElement? parameters, IAssemblyManager manager)
    {
        var assemblyId = parameters?.GetStringProp("assemblyId");
        if (string.IsNullOrEmpty(assemblyId))
        {
            throw new ArgumentException("assemblyId is required");
        }

        var loaded = manager.Get(assemblyId)
            ?? throw new InvalidOperationException("Assembly not loaded");

        if (!loaded.Extensions.TryGetValue("decompiler", out var ext) || ext is not DecompilerState state)
        {
            throw new InvalidOperationException("Assembly not loaded with decompiler support");
        }

        var namespaces = new SortedSet<string>();
        foreach (var typeHandle in state.PeFile.Metadata.TypeDefinitions)
        {
            var typeDef = state.PeFile.Metadata.GetTypeDefinition(typeHandle);
            var name = state.PeFile.Metadata.GetString(typeDef.Name);
            if (string.IsNullOrEmpty(name) || name.StartsWith("<") || typeDef.IsNested)
            {
                continue;
            }
            var ns = state.PeFile.Metadata.GetString(typeDef.Namespace);
            namespaces.Add(string.IsNullOrEmpty(ns) ? "(global)" : ns);
        }

        return Task.FromResult<object?>(new
        {
            assemblyId,
            namespaces = namespaces.ToList(),
        });
    }
}
