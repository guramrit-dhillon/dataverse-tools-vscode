/** Command and View IDs owned by the FetchXML Builder extension. */
export const Commands = {
  FetchXmlNewQuery: "dataverse-tools.fetchxml.newQuery",
  FetchXmlExecute: "dataverse-tools.fetchxml.execute",
  FetchXmlCopyXml: "dataverse-tools.fetchxml.copyXml",
  FetchXmlOpenFile: "dataverse-tools.fetchxml.openFile",
  FetchXmlSaveFile: "dataverse-tools.fetchxml.saveFile",
  FetchXmlAddChild: "dataverse-tools.fetchxml.addChild",
  FetchXmlDeleteNode: "dataverse-tools.fetchxml.deleteNode",
  FetchXmlSelectNode: "dataverse-tools.fetchxml.selectNode",
  FetchXmlSelectEnvironment: "dataverse-tools.fetchxml.selectEnvironment",
  FetchXmlPreviewXml: "dataverse-tools.fetchxml.previewXml",
  FetchXmlDuplicateNode: "dataverse-tools.fetchxml.duplicateNode",
  FetchXmlMoveNodeUp: "dataverse-tools.fetchxml.moveNodeUp",
  FetchXmlMoveNodeDown: "dataverse-tools.fetchxml.moveNodeDown",
} as const;

export const Views = {
  FetchXmlTree: "dataverse-tools.fetchxmlTree",
  FetchXmlProperties: "dataverse-tools.fetchxmlProperties",
  CsvViewer: "dataverse-tools.csvViewer",
} as const;
