using System.Text.Json;

namespace AssemblyBackend.Protocol;

public record Request
{
    public string Id { get; init; } = string.Empty;
    public string Command { get; init; } = string.Empty;
    public JsonElement? Params { get; init; }
}
