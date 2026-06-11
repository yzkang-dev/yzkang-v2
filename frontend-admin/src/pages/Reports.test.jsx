import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Reports from "../pages/Reports";

// Reports.jsx uses: api directly, xlsx, recharts, antd
vi.mock("../api", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
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
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
}));

// Mock xlsx
vi.mock("xlsx", () => ({
  utils: { json_to_sheet: () => ({}), book_new: () => ({}), book_append_sheet: () => ({}) },
  writeFile: vi.fn(),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Reports", () => {
  it("renders reports page", () => {
    renderWithRouter(<Reports />);
    expect(screen.getByText("报表中心")).toBeInTheDocument();
  });
});
