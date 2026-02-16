import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#1b804c" },
    background: {
      default: "#1b804c", // app background
      paper: "#ffffff",   // card surfaces
    },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: `"Inter", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
  },
});
