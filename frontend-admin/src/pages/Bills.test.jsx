import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Bills from "../pages/Bills";

// Bills.jsx uses: useApi hook, useElders context, antd components
vi.mock("../hooks/useApi", () => ({
  default: vi.fn(() => ({ data: [], loading: false, error: null, refetch: vi.fn() })),
}));

vi.mock("../context/EldersContext", () => ({
  useElders: () => ({ elders: [], filterElders: () => [] }),
}));

vi.mock("../api", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Bills", () => {
  it("renders bills page", () => {
    renderWithRouter(<Bills />);
    expect(screen.getByText("费用账单")).toBeInTheDocument();
  });

  it("renders table", () => {
    renderWithRouter(<Bills />);
    expect(screen.getByText(/创建账单|新建/)).toBeInTheDocument();
  });
});
