using System.Reflection;

namespace AssemblyBackend;

public class LoadedAssembly : IDisposable
{
    public required string AssemblyId { get; init; }
    public required byte[] RawBytes { get; init; }
    public string? FilePath { get; init; }
    public MetadataLoadContext? MetadataContext { get; init; }
    public Assembly? MetadataAssembly { get; init; }

    /// <summary>
    /// Extensibility point: command handlers can attach their own per-assembly state.
    /// E.g. the decompiler handler stores its PEFile/CSharpDecompiler here.
    /// </summary>
    public Dictionary<string, IDisposable> Extensions { get; } = new();

    public void Dispose()
    {
        MetadataContext?.Dispose();
        foreach (var ext in Extensions.Values)
        {
            ext.Dispose();
        }
        Extensions.Clear();
    }
}
