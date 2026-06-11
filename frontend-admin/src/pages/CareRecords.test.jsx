import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CareRecords from "../pages/CareRecords";

// CareRecords.jsx uses: useApi hook, useElders context
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

describe("CareRecords", () => {
  it("renders care records page", () => {
    renderWithRouter(<CareRecords />);
    expect(screen.getByText("护理记录")).toBeInTheDocument();
  });
});
