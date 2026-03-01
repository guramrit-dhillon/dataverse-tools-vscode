using System.Text.Json;
using AssemblyBackend;
using ICSharpCode.Decompiler.TypeSystem;

namespace DataverseAssemblyDecompiler.Handlers;

public class DecompileTypeHandler : ICommandHandler
{
    public string Name => "decompileType";

    public Task<object?> HandleAsync(JsonElement? parameters, IAssemblyManager manager)
    {
        var assemblyId = parameters?.GetStringProp("assemblyId");
        var typeFullName = parameters?.GetStringProp("typeFullName");

        if (string.IsNullOrEmpty(assemblyId))
        {
            throw new ArgumentException("assemblyId is required");
        }

        if (string.IsNullOrEmpty(typeFullName))
        {
            throw new ArgumentException("typeFullName is required");
        }

        var loaded = manager.Get(assemblyId)
            ?? throw new InvalidOperationException("Assembly not loaded");

        if (!loaded.Extensions.TryGetValue("decompiler", out var ext) || ext is not DecompilerState state)
        {
            throw new InvalidOperationException("Assembly not loaded with decompiler support");
        }

        // Check cache first
        if (state.SourceCache.TryGetValue(typeFullName, out var cached))
        {
            return Task.FromResult<object?>(new
            {
                assemblyId,
                typeFullName,
                source = cached,
            });
        }

        string source;
        try
        {
            var fullTypeName = new FullTypeName(typeFullName);
            source = state.Decompiler.DecompileTypeAsString(fullTypeName);
        }
        catch (Exception ex)
        {
            source = $"// Decompilation failed for {typeFullName}\n// Error: {ex.Message}\n";
        }

        // Cache the result
        state.SourceCache[typeFullName] = source;

        return Task.FromResult<object?>(new
        {
            assemblyId,
            typeFullName,
            source,
        });
    }
}
