import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Login from "../pages/Login";

// Login.jsx uses: useLogin hook, api.post, useNavigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../api", () => ({
  default: {
    post: vi.fn(() => Promise.resolve({
      data: { access_token: "tok", refresh_token: "ref", real_name: "测试用户" },
    })),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ setAuth: vi.fn() }),
}));

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Login", () => {
  it("renders login page", () => {
    renderWithRouter(<Login />);
    expect(screen.getByText(/颐智康养|Login/)).toBeInTheDocument();
  });

  it("renders login button", () => {
    renderWithRouter(<Login />);
    expect(screen.getByRole("button", { name: /登\s*录/ })).toBeInTheDocument();
  });
});
