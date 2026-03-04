import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';

/**
 * Component Showcase
 * Demonstrates all button states, badges, and UI components
 * Following the EventPro design system
 */
export function ComponentShowcase() {
  return (
    <div className="p-8 space-y-12 bg-[#F5F7FA] min-h-screen">
      <div>
        <h1 className="text-4xl mb-2 text-[#0F1C2E]">EventPro Design System</h1>
        <p className="text-gray-600">Component showcase and style guide</p>
      </div>

      {/* Buttons */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#0F1C2E]">Buttons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm mb-3 text-gray-600">Primary Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <Button className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90">
                Default
              </Button>
              <Button className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90" disabled>
                Disabled
              </Button>
              <Button className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90" size="lg">
                Large
              </Button>
              <Button className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90" size="sm">
                Small
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm mb-3 text-gray-600">Accent Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <Button className="bg-[#D6C6A5] hover:bg-[#D6C6A5]/90 text-[#0F1C2E]">
                Accent
              </Button>
              <Button className="bg-[#D6C6A5] hover:bg-[#D6C6A5]/90 text-[#0F1C2E]" disabled>
                Disabled
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm mb-3 text-gray-600">Outline Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <Button variant="outline">Outline</Button>
              <Button variant="outline" disabled>Disabled</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm mb-3 text-gray-600">Status Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <Button className="bg-[#22C55E] hover:bg-[#22C55E]/90">
                <CheckCircle className="w-4 h-4 mr-2" />
                Success
              </Button>
              <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90">
                <Clock className="w-4 h-4 mr-2" />
                Warning
              </Button>
              <Button className="bg-[#EF4444] hover:bg-[#EF4444]/90">
                <XCircle className="w-4 h-4 mr-2" />
                Danger
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#0F1C2E]">Badges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm mb-3 text-gray-600">Status Badges</h3>
            <div className="flex flex-wrap gap-4">
              <Badge className="bg-[#22C55E] text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Checked In
              </Badge>
              <Badge className="bg-[#D6C6A5] text-[#0F1C2E]">
                <Clock className="w-3 h-3 mr-1" />
                Confirmed
              </Badge>
              <Badge className="bg-gray-400 text-white">
                <XCircle className="w-3 h-3 mr-1" />
                Pending
              </Badge>
              <Badge className="bg-[#EF4444] text-white">
                <AlertCircle className="w-3 h-3 mr-1" />
                Error
              </Badge>
            </div>
          </div>

          <div>
            <h3 className="text-sm mb-3 text-gray-600">Variant Badges</h3>
            <div className="flex flex-wrap gap-4">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#0F1C2E]">Color Palette</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <div className="h-24 rounded-lg bg-[#0F1C2E] mb-2"></div>
              <p className="text-sm text-[#0F1C2E]">Primary</p>
              <code className="text-xs text-gray-600">#0F1C2E</code>
            </div>
            <div>
              <div className="h-24 rounded-lg bg-[#D6C6A5] mb-2"></div>
              <p className="text-sm text-[#0F1C2E]">Accent</p>
              <code className="text-xs text-gray-600">#D6C6A5</code>
            </div>
            <div>
              <div className="h-24 rounded-lg bg-[#F5F7FA] border border-gray-200 mb-2"></div>
              <p className="text-sm text-[#0F1C2E]">Secondary</p>
              <code className="text-xs text-gray-600">#F5F7FA</code>
            </div>
            <div>
              <div className="h-24 rounded-lg bg-[#22C55E] mb-2"></div>
              <p className="text-sm text-[#0F1C2E]">Success</p>
              <code className="text-xs text-gray-600">#22C55E</code>
            </div>
            <div>
              <div className="h-24 rounded-lg bg-[#F59E0B] mb-2"></div>
              <p className="text-sm text-[#0F1C2E]">Warning</p>
              <code className="text-xs text-gray-600">#F59E0B</code>
            </div>
            <div>
              <div className="h-24 rounded-lg bg-[#EF4444] mb-2"></div>
              <p className="text-sm text-[#0F1C2E]">Danger</p>
              <code className="text-xs text-gray-600">#EF4444</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#0F1C2E]">Typography</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-[#0F1C2E]">Heading 1 - Inter Font</h1>
          </div>
          <div>
            <h2 className="text-[#0F1C2E]">Heading 2 - Inter Font</h2>
          </div>
          <div>
            <h3 className="text-[#0F1C2E]">Heading 3 - Inter Font</h3>
          </div>
          <div>
            <h4 className="text-[#0F1C2E]">Heading 4 - Inter Font</h4>
          </div>
          <div>
            <p className="text-gray-700">
              Body text using Inter font family. Clean, modern, and highly readable for professional events.
            </p>
          </div>
          <div>
            <code className="bg-gray-100 px-2 py-1 rounded text-sm text-[#0F1C2E]">
              Monospace code: EVT-2026-001
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
