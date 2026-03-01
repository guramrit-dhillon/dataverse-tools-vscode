using System.Text.Json;

namespace AssemblyBackend.Handlers;

public class LoadHandler : ICommandHandler
{
    public string Name => "load";

    public Task<object?> HandleAsync(JsonElement? parameters, IAssemblyManager manager)
    {
        if (parameters is null)
        {
            throw new ArgumentException("Parameters are required");
        }

        var p = parameters.Value;
        var assemblyId = p.GetStringProp("assemblyId");
        var filePath = p.GetStringProp("filePath");
        var base64 = p.GetStringProp("base64");
        var resolverPaths = p.GetStringArrayProp("resolverPaths");

        if (string.IsNullOrEmpty(assemblyId))
        {
            throw new ArgumentException("assemblyId is required");
        }

        if (!string.IsNullOrEmpty(filePath))
        {
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"Assembly not found: {filePath}");
            }
            manager.LoadFromPath(assemblyId, filePath, resolverPaths);
        }
        else if (!string.IsNullOrEmpty(base64))
        {
            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(base64);
            }
            catch (FormatException)
            {
                throw new ArgumentException("Invalid base64 content");
            }
            manager.LoadFromBytes(assemblyId, bytes, resolverPaths);
        }
        else
        {
            throw new ArgumentException("Either filePath or base64 is required");
        }

        return Task.FromResult<object?>(new { assemblyId, loaded = true });
    }
}
