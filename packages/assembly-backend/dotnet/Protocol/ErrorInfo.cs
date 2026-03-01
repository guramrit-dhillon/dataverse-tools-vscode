namespace AssemblyBackend.Protocol;

public record ErrorInfo
{
    public string Code { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}
