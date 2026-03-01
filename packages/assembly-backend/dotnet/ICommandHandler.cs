using System.Text.Json;

namespace AssemblyBackend;

public interface ICommandHandler
{
    string Name { get; }
    Task<object?> HandleAsync(JsonElement? parameters, IAssemblyManager manager);
}
