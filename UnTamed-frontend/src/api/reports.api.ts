import { http } from "./http";
import type { CreateReportRequest, ReportResponse } from "../types/report";

export async function submitReport(body: CreateReportRequest): Promise<ReportResponse> {
  const { data } = await http.post<ReportResponse>("/api/reports", body);
  return data;
}
