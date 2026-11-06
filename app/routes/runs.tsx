import { Outlet } from "react-router";

export function meta() {
  return [
    { title: "Handoff" },
    {
      name: "description",
      content:
        "Runbooks you and your agent run together. Every step has an owner, and the baton passes between you.",
    },
  ];
}

export default function RunsLayout() {
  return <Outlet />;
}
