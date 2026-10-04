import { Button } from "@pursor/ui/components/button";
import { Sparkle } from "lucide-react";
import { Kbd } from "@pursor/ui/components/kbd";


export const ProjectsView = () => {
  return (
    <div className="min-h bg-sidebar flex flex-col items-center p-6 md:p-16">
          <div className="w-full max-w-sm mx-auto flex flex-col gap-4 items-center">
              <div className="flex justify-between gap-4 w-full items-center">
                  <div className="flex items-center gap-2 w-full group/logo">
                      <img src="/logo.svg" alt="Pursor" className="size-8 md:size-11.5" />
                      <h1 className="text-4xl md:text-5xl font-semibold">Pursor</h1>
                  </div>
              </div>
              <div className="flex flex-col gap-4 w-full">
                  <div className="grid grid-cols-2 gap-2 ">
                      <Button variant="outline" className="h-full items-start p-4 bg-background border flex flex-col gap-6">
                          <div className="flex items-center w-full justify-between">
                              <Sparkle className="size-4" />
                              <Kbd className="px-2">
                                  Cmd + J
                              </Kbd>
                          </div>
                          <div>
                              New
                          </div>
                      </Button>
                  </div>
              </div>
          </div>
    </div>
  );
}
