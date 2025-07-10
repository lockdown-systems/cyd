import React from "react";
// eslint-disable-next-line import/no-unresolved
import { Redirect } from "@docusaurus/router";

export default function Home() {
  return <Redirect to="/docs/intro/" />;
}
