import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import VideoMonitoring from "../pages/VideoMonitoring";

// VideoMonitoring.jsx uses: useApi
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

describe("VideoMonitoring", () => {
  it("renders video monitoring page", () => {
    renderWithRouter(<VideoMonitoring />);
    expect(screen.getByText("视频监控中心")).toBeInTheDocument();
  });
});
