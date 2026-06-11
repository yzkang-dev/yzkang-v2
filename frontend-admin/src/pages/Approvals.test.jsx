import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Approvals from "../pages/Approvals";

// Approvals.jsx uses: useApi hook, api.get() for users
vi.mock("../hooks/useApi", () => ({
  default: vi.fn(() => ({ data: [], loading: false, error: null, refetch: vi.fn() })),
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

describe("Approvals", () => {
  it("renders approvals page", () => {
    renderWithRouter(<Approvals />);
    expect(screen.getByText(/审批管理|Approvals/)).toBeInTheDocument();
  });

  it("renders tabs", () => {
    renderWithRouter(<Approvals />);
    expect(screen.getByText(/全部|All/)).toBeInTheDocument();
  });
});
