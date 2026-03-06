import { HttpError } from "./http-error";

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

  /** Parse an HTTP error into a DataverseError. Returns undefined if not a Dataverse API error. */
  static fromRequest(err: unknown): DataverseError | undefined {
    if (!(err instanceof HttpError)) {
      return undefined;
    }
    const status = err.status;
    const dvError = (err.data as Record<string, unknown> | undefined)?.error as Record<string, unknown> | undefined;
    if (!dvError?.message) {
      return undefined;
    }
    return new DataverseError({
      message: dvError.message as string,
      statusCode: status ?? 0,
      errorCode: dvError.code as string | undefined,
      helpLink: dvError["@Microsoft.PowerApps.CDS.HelpLink"] as string | undefined,
      traceText: dvError["@Microsoft.PowerApps.CDS.TraceText"] as string | undefined,
      innerMessage: dvError["@Microsoft.PowerApps.CDS.InnerError.Message"] as string | undefined,
      operationStatus: dvError["@Microsoft.PowerApps.CDS.ErrorDetails.OperationStatus"] as string | undefined,
      subErrorCode: dvError["@Microsoft.PowerApps.CDS.ErrorDetails.SubErrorCode"] as string | undefined,
    });
  }
}
