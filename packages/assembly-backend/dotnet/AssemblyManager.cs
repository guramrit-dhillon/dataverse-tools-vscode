using System.Reflection;

namespace AssemblyBackend;

public class AssemblyManager : IAssemblyManager
{
    private readonly Dictionary<string, LoadedAssembly> _assemblies = new();

    public LoadedAssembly LoadFromPath(string assemblyId, string filePath, string[]? resolverPaths = null)
    {
        Unload(assemblyId);

        var bytes = File.ReadAllBytes(filePath);

        var assemblyDir = Path.GetDirectoryName(filePath)!;
        var dlls = GetRuntimeAssemblies()
            .Concat(Directory.GetFiles(assemblyDir, "*.dll"));

        if (resolverPaths is not null)
        {
            foreach (var dir in resolverPaths)
            {
                if (Directory.Exists(dir))
                {
                    dlls = dlls.Concat(Directory.GetFiles(dir, "*.dll"));
                }
            }
        }

        var resolver = new PathAssemblyResolver(dlls.Distinct());
        var mlc = new MetadataLoadContext(resolver);
        var assembly = mlc.LoadFromAssemblyPath(filePath);

        var loaded = new LoadedAssembly
        {
            AssemblyId = assemblyId,
            RawBytes = bytes,
            FilePath = filePath,
            MetadataContext = mlc,
            MetadataAssembly = assembly,
        };

        _assemblies[assemblyId] = loaded;
        return loaded;
    }

    public LoadedAssembly LoadFromBytes(string assemblyId, byte[] bytes, string[]? resolverPaths = null)
    {
        Unload(assemblyId);

        MetadataLoadContext? mlc = null;
        Assembly? assembly = null;

        // If resolver paths are provided, write to temp file and create MLC
        if (resolverPaths is { Length: > 0 })
        {
            var tempPath = Path.Combine(Path.GetTempPath(), $"{assemblyId}_{Guid.NewGuid():N}.dll");
            File.WriteAllBytes(tempPath, bytes);

            try
            {
                var dlls = GetRuntimeAssemblies()
                    .Concat(new[] { tempPath });

                foreach (var dir in resolverPaths)
                {
                    if (Directory.Exists(dir))
                    {
                        dlls = dlls.Concat(Directory.GetFiles(dir, "*.dll"));
                    }
                }

                var resolver = new PathAssemblyResolver(dlls.Distinct());
                mlc = new MetadataLoadContext(resolver);
                assembly = mlc.LoadFromAssemblyPath(tempPath);
            }
            catch
            {
                mlc?.Dispose();
                try { File.Delete(tempPath); } catch { }
                throw;
            }
        }

        var loaded = new LoadedAssembly
        {
            AssemblyId = assemblyId,
            RawBytes = bytes,
            MetadataContext = mlc,
            MetadataAssembly = assembly,
        };

        _assemblies[assemblyId] = loaded;
        return loaded;
    }

    public LoadedAssembly? Get(string assemblyId)
    {
        return _assemblies.GetValueOrDefault(assemblyId);
    }

    public bool Unload(string assemblyId)
    {
        if (_assemblies.Remove(assemblyId, out var existing))
        {
            existing.Dispose();
            return true;
        }
        return false;
    }

    public void Dispose()
    {
        foreach (var loaded in _assemblies.Values)
        {
            loaded.Dispose();
        }
        _assemblies.Clear();
    }

    /// <summary>
    /// Returns runtime assembly paths for MetadataLoadContext resolution.
    /// Handles single-file self-contained apps where RuntimeEnvironment.GetRuntimeDirectory()
    /// may return a path inside the bundle rather than the real shared framework.
    /// </summary>
    private static IEnumerable<string> GetRuntimeAssemblies()
    {
        // 1. Try TRUSTED_PLATFORM_ASSEMBLIES — filter to paths that exist on disk
        var tpa = AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") as string;
        if (!string.IsNullOrEmpty(tpa))
        {
            var existing = tpa.Split(Path.PathSeparator).Where(File.Exists).ToArray();
            if (existing.Length > 0)
            {
                return existing;
            }
        }

        // 2. Try RuntimeEnvironment.GetRuntimeDirectory()
        var runtimeDir = System.Runtime.InteropServices.RuntimeEnvironment.GetRuntimeDirectory();
        if (Directory.Exists(runtimeDir) && Directory.GetFiles(runtimeDir, "System.Runtime.dll").Length > 0)
        {
            return Directory.GetFiles(runtimeDir, "*.dll");
        }

        // 3. Probe well-known .NET shared framework locations
        var dotnetRoot = Environment.GetEnvironmentVariable("DOTNET_ROOT")
            ?? (OperatingSystem.IsWindows()
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "dotnet")
                : OperatingSystem.IsMacOS()
                    ? "/usr/local/share/dotnet"
                    : "/usr/share/dotnet");

        var sharedDir = Path.Combine(dotnetRoot, "shared", "Microsoft.NETCore.App");
        if (Directory.Exists(sharedDir))
        {
            // Pick the highest version available
            var latest = Directory.GetDirectories(sharedDir)
                .OrderByDescending(d => d)
                .FirstOrDefault();
            if (latest is not null)
            {
                return Directory.GetFiles(latest, "*.dll");
            }
        }

        return [];
    }
}
