import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AuditLogs from "../pages/AuditLogs";

// AuditLogs.jsx uses: useState, api.get() directly
vi.mock("../api", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { items: [], total: 0 } })),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("AuditLogs", () => {
  it("renders audit logs page", () => {
    renderWithRouter(<AuditLogs />);
    expect(screen.getByText(/操作审计日志|Audit|审计/)).toBeInTheDocument();
  });
});
