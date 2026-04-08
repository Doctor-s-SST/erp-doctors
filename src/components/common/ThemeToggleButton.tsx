import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { Moon, Sun } from "lucide-react";

export const ThemeToggleButton: React.FC = () => {
  const { toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-dark-900 h-9 w-9 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
    >
      <Sun className="hidden dark:block w-5 h-5" />
      <Moon
        className="dark:hidden w-5 h-5" />
    </button>
  );
};
