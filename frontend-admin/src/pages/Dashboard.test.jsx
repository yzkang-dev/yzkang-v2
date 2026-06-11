import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../pages/Dashboard";

// Dashboard.jsx uses: useApi hook (x2 — dashboard data + alerts count)
vi.mock("../hooks/useApi", () => ({
  default: vi.fn((_fn, opts) => {
    // 默认返回包含所有关键字段的数据
    const defaultData = {
      total_elders: 42,
      checked_in_today: 3,
      checked_out_today: 1,
      occupancy_rate: 85.5,
      monthly_revenue: 128000,
      unpaid_bills: 5,
      overdue_bills: 2,
      abnormal_today: 3,
    };
    return { data: defaultData, loading: false, error: null, refetch: vi.fn() };
  }),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Dashboard", () => {
  it("renders dashboard heading", () => {
    renderWithRouter(<Dashboard />);
    expect(screen.getByText(/院长看板|Dashboard/)).toBeInTheDocument();
  });
});
