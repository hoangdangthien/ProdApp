import axios from "axios";

// Default the backend host to whatever machine served this page, so the app
// works for any computer on the network (not just the server's own browser).
const API = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    `http://${window.location.hostname}:8000`,
});

export const getFilters = () => API.get("/api/filters");

export const getCascadingFilters = (params) =>
  API.get("/api/filters/cascading", { params });

export const getProduction = (uniqueId) =>
  API.get("/api/production", { params: { unique_id: uniqueId } });

export const getProductionMulti = (uniqueIds) =>
  API.get("/api/production/multi", {
    params: { unique_ids: uniqueIds.join(",") },
  });

export const getInjection = (uniqueId) =>
  API.get("/api/injection", { params: { unique_id: uniqueId } });

export const getMaster = (params) => API.get("/api/master", { params });

export const getABC = (params) => API.get("/api/abc", { params });

export const getABCTracking = (params) => API.get("/api/abc/tracking", { params });

export const getElementNumbers = (params) =>
  API.get("/api/element-numbers", { params });

export const getProductionDates = () => API.get("/api/production-dates");

export const getYearlySummary = (year) =>
  API.get("/api/production/yearly-summary", { params: { year } });

export const getReservoirSummary = (field, reservoir) =>
  API.get("/api/production/reservoir-summary", { params: { field, reservoir } });

export const getFieldReservoirBreakdown = (year) =>
  API.get("/api/production/field-reservoir-breakdown", { params: { year } });

export const getBlockFieldBreakdown = (year) =>
  API.get("/api/production/block-field-breakdown", { params: { year } });
