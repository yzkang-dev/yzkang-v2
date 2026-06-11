import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Medications from "../pages/Medications";

// Medications.jsx uses: useApi hook, useElders context
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
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Medications", () => {
  it("renders medications page", () => {
    renderWithRouter(<Medications />);
    expect(screen.getByText("用药管理")).toBeInTheDocument();
  });
});
