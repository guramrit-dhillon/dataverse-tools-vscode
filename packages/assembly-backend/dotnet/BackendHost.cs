using System.Text.Json;
using System.Text.Json.Serialization;
using AssemblyBackend.Protocol;

namespace AssemblyBackend;

public static class BackendHost
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };

    public static async Task<int> RunAsync(string[] args, params ICommandHandler[] handlers)
    {
        var handlerMap = new Dictionary<string, ICommandHandler>(StringComparer.OrdinalIgnoreCase);

        // Register built-in handlers
        var loadHandler = new Handlers.LoadHandler();
        var unloadHandler = new Handlers.UnloadHandler();
        handlerMap[loadHandler.Name] = loadHandler;
        handlerMap[unloadHandler.Name] = unloadHandler;

        // Register custom handlers (can override built-ins)
        foreach (var handler in handlers)
        {
            handlerMap[handler.Name] = handler;
        }

        using var manager = new AssemblyManager();

        // Determine mode from args
        if (IsExecMode(args, out var method, out var paramsJson))
        {
            return await RunExec(method, paramsJson, handlerMap, manager);
        }

        // Default: stdio mode
        return await RunStdio(handlerMap, manager);
    }

    private static bool IsExecMode(string[] args, out string method, out string? paramsJson)
    {
        method = string.Empty;
        paramsJson = null;

        bool isExec = false;
        for (int i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--exec":
                    isExec = true;
                    break;
                case "--method" when i + 1 < args.Length:
                    method = args[++i];
                    break;
                case "--params" when i + 1 < args.Length:
                    paramsJson = args[++i];
                    break;
            }
        }

        return isExec && !string.IsNullOrEmpty(method);
    }

    private static async Task<int> RunExec(
        string method,
        string? paramsJson,
        Dictionary<string, ICommandHandler> handlers,
        AssemblyManager manager)
    {
        JsonElement? parameters = null;
        if (!string.IsNullOrEmpty(paramsJson))
        {
            try
            {
                parameters = JsonDocument.Parse(paramsJson).RootElement;
            }
            catch (JsonException ex)
            {
                WriteResponse(new Response
                {
                    Id = "exec",
                    Error = new ErrorInfo { Code = "PARSE_ERROR", Message = $"Invalid --params JSON: {ex.Message}" },
                });
                return 1;
            }
        }

        if (!handlers.TryGetValue(method, out var handler))
        {
            WriteResponse(new Response
            {
                Id = "exec",
                Error = new ErrorInfo { Code = "UNKNOWN_COMMAND", Message = $"Unknown method: {method}" },
            });
            return 1;
        }

        try
        {
            var result = await handler.HandleAsync(parameters, manager);
            WriteResponse(new Response
            {
                Id = "exec",
                Result = result is not null
                    ? JsonSerializer.SerializeToElement(result, JsonOptions)
                    : null,
            });
            return 0;
        }
        catch (Exception ex)
        {
            WriteResponse(new Response
            {
                Id = "exec",
                Error = new ErrorInfo { Code = "INTERNAL_ERROR", Message = ex.Message },
            });
            return 1;
        }
    }

    private static async Task<int> RunStdio(
        Dictionary<string, ICommandHandler> handlers,
        AssemblyManager manager)
    {
        using var reader = new StreamReader(Console.OpenStandardInput());

        while (true)
        {
            string? line;
            try
            {
                line = await reader.ReadLineAsync();
            }
            catch
            {
                break;
            }

            if (line is null)
            {
                break; // stdin closed
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            Request? request;
            try
            {
                request = JsonSerializer.Deserialize<Request>(line, JsonOptions);
            }
            catch (JsonException ex)
            {
                WriteResponse(new Response
                {
                    Id = "unknown",
                    Error = new ErrorInfo { Code = "PARSE_ERROR", Message = ex.Message },
                });
                continue;
            }

            if (request is null || string.IsNullOrEmpty(request.Id))
            {
                WriteResponse(new Response
                {
                    Id = request?.Id ?? "unknown",
                    Error = new ErrorInfo { Code = "INVALID_REQUEST", Message = "Missing id or command" },
                });
                continue;
            }

            // Handle shutdown
            if (request.Command == "shutdown")
            {
                WriteResponse(new Response
                {
                    Id = request.Id,
                    Result = JsonSerializer.SerializeToElement(new { ok = true }, JsonOptions),
                });
                break;
            }

            var response = await HandleRequest(request, handlers, manager);
            WriteResponse(response);
        }

        return 0;
    }

    private static async Task<Response> HandleRequest(
        Request request,
        Dictionary<string, ICommandHandler> handlers,
        AssemblyManager manager)
    {
        if (!handlers.TryGetValue(request.Command, out var handler))
        {
            return new Response
            {
                Id = request.Id,
                Error = new ErrorInfo { Code = "UNKNOWN_COMMAND", Message = $"Unknown command: {request.Command}" },
            };
        }

        try
        {
            var result = await handler.HandleAsync(request.Params, manager);
            return new Response
            {
                Id = request.Id,
                Result = result is not null
                    ? JsonSerializer.SerializeToElement(result, JsonOptions)
                    : null,
            };
        }
        catch (Exception ex)
        {
            return new Response
            {
                Id = request.Id,
                Error = new ErrorInfo { Code = "INTERNAL_ERROR", Message = ex.Message },
            };
        }
    }

    private static void WriteResponse(Response response)
    {
        var json = JsonSerializer.Serialize(response, JsonOptions);
        Console.Out.WriteLine(json);
        Console.Out.Flush();
    }
}
