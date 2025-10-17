import { Link } from "@tanstack/react-router";
import { useTRPC } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { Button } from "./ui/button";

export default function Header() {
  const trpc = useTRPC();
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Demo" },
  ];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map(({ to, label }) => {
            return (
              <Link 
                key={to} 
                to={to}
                className="text-lg font-medium text-foreground/80 transition-colors hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold"
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Health Check - Hidden on small screens */}
          <div className="hidden sm:flex items-center gap-3">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                healthCheck.data ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium text-muted-foreground">
              {healthCheck.isLoading
                ? "Checking..."
                : healthCheck.data
                ? "API Connected"
                : "API Disconnected"}
            </span>
          </div>
          
          {/* Health Check Indicator - Mobile only */}
          <div className="sm:hidden">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                healthCheck.data ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
          </div>
          
          <ModeToggle />
          <UserMenu />
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur">
          <nav className="px-4 py-4 space-y-2">
            {links.map(({ to, label }) => {
              return (
                <Link 
                  key={to} 
                  to={to}
                  className="block py-2 text-lg font-medium text-foreground/80 transition-colors hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {label}
                </Link>
              );
            })}
            {/* Health Check in Mobile Menu */}
            <div className="flex items-center gap-3 py-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  healthCheck.data ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {healthCheck.isLoading
                  ? "Checking..."
                  : healthCheck.data
                  ? "API Connected"
                  : "API Disconnected"}
              </span>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
