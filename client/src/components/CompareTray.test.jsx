import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompareTray from "./CompareTray.jsx";

const home = (id, price) => ({ id, deal: "buy", type: "Apartment", bhk: 2, area: 1000, price, hue: 40, locality: "Baner", title: `Home ${id}` });

describe("CompareTray", () => {
  test("renders nothing when empty", () => {
    const { container } = render(<CompareTray items={[]} onRemove={() => {}} onCompare={() => {}} onClear={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("needs at least two homes before comparing", () => {
    render(<CompareTray items={[home("a", 9_000_000)]} onRemove={() => {}} onCompare={() => {}} onClear={() => {}} />);
    expect(screen.getByRole("button", { name: "Compare 1" })).toBeDisabled();
    expect(screen.getAllByText("+ Add home")).toHaveLength(2);
  });

  test("compare, remove and clear call back", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn(), onCompare = vi.fn(), onClear = vi.fn();
    const items = [home("a", 9_000_000), home("b", 12_500_000)];
    render(<CompareTray items={items} onRemove={onRemove} onCompare={onCompare} onClear={onClear} />);

    expect(screen.getByText("₹90L")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Compare 2" }));
    expect(onCompare).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Remove Home b from compare" }));
    expect(onRemove).toHaveBeenCalledWith(items[1]);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
