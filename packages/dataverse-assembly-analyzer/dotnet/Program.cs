using System.Text.Json;
using AssemblyBackend;
using DataversePluginAnalyzer.Handlers;

// Backward-compatible CLI: translate --assembly <path> to --exec mode
if (args.Contains("--assembly"))
{
    var idx = Array.IndexOf(args, "--assembly");
    if (idx + 1 < args.Length)
    {
        var assemblyPath = args[idx + 1];
        args = ["--exec", "--method", "analyzePlugins", "--params",
                JsonSerializer.Serialize(new { assemblyPath })];
    }
}

return await BackendHost.RunAsync(args, new AnalyzePluginsHandler());
