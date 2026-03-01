using System.Text.Json;

namespace AssemblyBackend.Protocol;

public record Response
{
    public string Id { get; init; } = string.Empty;
    public JsonElement? Result { get; init; }
    public ErrorInfo? Error { get; init; }
}
