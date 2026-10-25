import { Link } from "react-router-dom";
import { Leaf } from "@/components/layout/Leaf";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
    <Leaf className="mb-6 h-8 w-8 text-primary" />
    <h1 className="text-3xl">There's nothing at this address</h1>
    <p className="mt-3 max-w-sm text-muted-foreground">The link may be old, or the page was moved. Head back and pick up where you left off.</p>
    <Button asChild className="mt-8">
      <Link to="/">Go to Crewly</Link>
    </Button>
  </div>
);

export default NotFound;
