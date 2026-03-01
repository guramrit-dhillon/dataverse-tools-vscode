using AssemblyBackend;
using DataverseAssemblyDecompiler.Handlers;

return await BackendHost.RunAsync(args,
    new LoadAssemblyHandler(),
    new ListNamespacesHandler(),
    new ListTypesHandler(),
    new DecompileTypeHandler()
);
