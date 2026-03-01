import axios from "axios";

export class DataverseError extends Error {
  readonly statusCode: number;
  readonly errorCode?: string;
  readonly helpLink?: string;
  readonly traceText?: string;
  readonly innerMessage?: string;
  readonly operationStatus?: string;
  readonly subErrorCode?: string;

  constructor(options: {
    message: string;
    statusCode: number;
    errorCode?: string;
    helpLink?: string;
    traceText?: string;
    innerMessage?: string;
    operationStatus?: string;
    subErrorCode?: string;
  }) {
    super(options.message);
    this.name = "DataverseError";
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.helpLink = options.helpLink;
    this.traceText = options.traceText;
    this.innerMessage = options.innerMessage;
    this.operationStatus = options.operationStatus;
    this.subErrorCode = options.subErrorCode;
  }

  /** Parse an Axios error into a DataverseError. Returns undefined if not a Dataverse API error. */
  static fromRequest(err: unknown): DataverseError | undefined {
    if (!axios.isAxiosError(err)) {
      return undefined;
    }
    const { status, data } = err.response ?? {};
    const dvError = data?.error;
    if (!dvError?.message) {
      return undefined;
    }
    return new DataverseError({
      message: dvError.message,
      statusCode: status ?? 0,
      errorCode: dvError.code,
      helpLink: dvError["@Microsoft.PowerApps.CDS.HelpLink"],
      traceText: dvError["@Microsoft.PowerApps.CDS.TraceText"],
      innerMessage: dvError["@Microsoft.PowerApps.CDS.InnerError.Message"],
      operationStatus: dvError["@Microsoft.PowerApps.CDS.ErrorDetails.OperationStatus"],
      subErrorCode: dvError["@Microsoft.PowerApps.CDS.ErrorDetails.SubErrorCode"],
    });
  }
}
