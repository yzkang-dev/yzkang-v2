import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ContractPayments from "../pages/ContractPayments";

// ContractPayments.jsx uses: useState, api.get() directly, recharts, xlsx
vi.mock("../api", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({
      data: { total_contracts: 0, total_amount: 0, total_paid: 0, overdue_count: 0, pending_count: 0, collection_rate: 0, contracts: [], kanban: [] },
    })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <div>{children}</div>,
  Area: () => null,
  LineChart: ({ children }) => <div>{children}</div>,
  Line: () => null,
  PieChart: ({ children }) => <div>{children}</div>,
  Pie: ({ children }) => <div>{children}</div>,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// Mock xlsx
vi.mock("xlsx", () => ({
  utils: { json_to_sheet: () => ({}), book_new: () => ({}), book_append_sheet: () => {} },
  writeFile: vi.fn(),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("ContractPayments", () => {
  it("renders contract payments page", () => {
    renderWithRouter(<ContractPayments />);
    expect(screen.getByText("合同付款看板")).toBeInTheDocument();
  });
});
