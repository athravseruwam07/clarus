export const SESSION_COOKIE_NAME = "clarus_session";

export interface ConnectorLoginResponse {
  storageState: Record<string, unknown>;
  whoami: Record<string, unknown>;
}

export interface ConnectorRequestResponse<TData = unknown> {
  data: TData;
}

export interface D2LAccess {
  StartDate?: string | null;
  EndDate?: string | null;
  IsActive?: boolean;
}

export interface D2LOrgUnit {
  Id: number | string;
  Name: string;
  Code?: string | null;
}

export interface D2LEnrollmentItem {
  OrgUnit: D2LOrgUnit;
  Access?: D2LAccess | null;
  [key: string]: unknown;
}

export interface D2LEnrollmentsResponse {
  Items?: D2LEnrollmentItem[];
  [key: string]: unknown;
}
