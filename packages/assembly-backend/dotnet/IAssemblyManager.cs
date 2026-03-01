namespace AssemblyBackend;

public interface IAssemblyManager : IDisposable
{
    LoadedAssembly LoadFromPath(string assemblyId, string filePath, string[]? resolverPaths = null);
    LoadedAssembly LoadFromBytes(string assemblyId, byte[] bytes, string[]? resolverPaths = null);
    LoadedAssembly? Get(string assemblyId);
    bool Unload(string assemblyId);
}
