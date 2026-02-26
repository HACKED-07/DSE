import { IntroSection } from "./introSection";
import { Navbar } from "./Navbar";

export const Landing = () => {
  return (
    <div className="h-full w-screen">
      <div>
        <div className="sticky top-0 z-50">
          <Navbar />
          <hr />
        </div>
        <IntroSection />
      </div>
    </div>
  );
};
