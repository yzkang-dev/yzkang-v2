import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Alerts from "../pages/Alerts";

// Alerts.jsx uses: useState, api.get() directly, antd components
// Mock api module
vi.mock("../api", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", real_name: "管理员" } }),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Alerts", () => {
  it("renders alerts page title", () => {
    renderWithRouter(<Alerts />);
    expect(screen.getByText(/告警管理中心|Alerts/)).toBeInTheDocument();
  });

  it("renders tabs", () => {
    renderWithRouter(<Alerts />);
    expect(screen.getByText(/全部告警|All/)).toBeInTheDocument();
  });
});
