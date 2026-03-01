using System.Text.Json;

namespace AssemblyBackend.Handlers;

public class UnloadHandler : ICommandHandler
{
    public string Name => "unload";

    public Task<object?> HandleAsync(JsonElement? parameters, IAssemblyManager manager)
    {
        var assemblyId = parameters?.GetStringProp("assemblyId");

        if (string.IsNullOrEmpty(assemblyId))
        {
            throw new ArgumentException("assemblyId is required");
        }

        var unloaded = manager.Unload(assemblyId);
        return Task.FromResult<object?>(new { assemblyId, unloaded });
    }
}
