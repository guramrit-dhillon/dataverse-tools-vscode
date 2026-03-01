using ICSharpCode.Decompiler.CSharp;
using ICSharpCode.Decompiler.Metadata;

namespace DataverseAssemblyDecompiler;

internal class DecompilerState : IDisposable
{
    public required PEFile PeFile { get; init; }
    public required CSharpDecompiler Decompiler { get; init; }
    public required UniversalAssemblyResolver Resolver { get; init; }
    public Dictionary<string, string> SourceCache { get; } = new();

    public void Dispose()
    {
        PeFile.Dispose();
    }
}
