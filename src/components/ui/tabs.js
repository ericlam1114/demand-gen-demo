import React from 'react'
import { cn } from "@/lib/utils"

const TabsContext = React.createContext()

const Tabs = ({ value, onValueChange, defaultValue, className, children, ...props }) => {
  const [selectedValue, setSelectedValue] = React.useState(defaultValue || value)
  
  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
    }
  }, [value])
  
  const handleValueChange = (newValue) => {
    if (value === undefined) {
      setSelectedValue(newValue)
    }
    onValueChange?.(newValue)
  }
  
  return (
    <TabsContext.Provider value={{ value: selectedValue, onValueChange: handleValueChange }}>
      <div className={cn("", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabsList = ({ className, ...props }) => (
  <div
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500",
      className
    )}
    {...props}
  />
)

const TabsTrigger = ({ className, value, children, ...props }) => {
  const context = React.useContext(TabsContext)
  
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        context?.value === value
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-600 hover:text-slate-900",
        className
      )}
      onClick={() => context?.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  )
}

const TabsContent = ({ className, value, children, ...props }) => {
  const context = React.useContext(TabsContext)
  
  if (context?.value !== value) {
    return null
  }
  
  return (
    <div
      className={cn(
        "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent } 