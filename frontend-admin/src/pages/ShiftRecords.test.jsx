import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ShiftRecords from "../pages/ShiftRecords";

// ShiftRecords.jsx uses: useApi, useElders
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

describe("ShiftRecords", () => {
  it("renders shift records page", () => {
    renderWithRouter(<ShiftRecords />);
    expect(screen.getByText("交接班记录")).toBeInTheDocument();
  });
});
