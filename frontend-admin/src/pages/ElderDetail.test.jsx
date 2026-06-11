import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ElderDetail from "../pages/ElderDetail";

// ElderDetail.jsx uses: useApi (defaultData: null), useParams, antd Tabs
vi.mock("../hooks/useApi", () => ({
  default: vi.fn(() => ({
    data: { id: 1, name: "测试老人", gender: "M", age: 75, status: "checked_in", care_level: "basic", room: "301", bed: "A", phone: "13800138000", id_card: "123456", emergency_contact: "张三", emergency_phone: "13900139000" },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "1" }),
  useNavigate: () => vi.fn(),
  MemoryRouter: ({ children }) => children,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("ElderDetail", () => {
  it("renders detail page", () => {
    renderWithRouter(<ElderDetail />);
    expect(screen.getByText(/详细信息|Detail/)).toBeInTheDocument();
  });
});
