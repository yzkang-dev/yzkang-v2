import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ElderForm from "../pages/ElderForm";

// ElderForm.jsx uses: useNavigate, api.post
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  MemoryRouter: ({ children }) => children,
}));

vi.mock("../api", () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { access_token: "tok", refresh_token: "ref", real_name: "测试" } })),
    get: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("ElderForm", () => {
  it("renders elder form page", () => {
    renderWithRouter(<ElderForm />);
    expect(screen.getByText(/登记入住|ElderForm/)).toBeInTheDocument();
  });
});
