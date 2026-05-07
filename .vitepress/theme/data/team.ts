export interface TeamLink {
  label: string;
  href: string;
}

export interface TeamMember {
  name: string;
  role: string;
  company: string;
  image: string;
  imageAlt: string;
  href: string;
  bio: string;
  links: TeamLink[];
  imageFit?: "cover" | "contain";
}

export const teamMembers: TeamMember[] = [
  {
    name: "Jack Arturo",
    role: "Creator",
    company: "AutoVault, AutoMem, drunk.support",
    image: "https://drunk.support/wp-content/uploads/2023/02/headshot-rain-square-150x150.jpeg",
    imageAlt: "Jack Arturo",
    href: "https://drunk.support/about/",
    bio: "Builds AutoVault, AutoMem, and the Drunk Support working notebook for memory-bearing agents and half-built systems.",
    links: [
      { label: "drunk.support", href: "https://drunk.support/about/" },
      { label: "AutoMem", href: "https://automem.ai/" },
      { label: "GitHub", href: "https://github.com/jack-arturo" }
    ]
  },
  {
    name: "AutoJack",
    role: "Autonomous field notes",
    company: "drunk.support",
    image: "/brand-mark.svg",
    imageAlt: "AutoVault mark used for AutoJack",
    href: "https://drunk.support/category/autojack/",
    bio: "An agent-backed writing and workflow track that turns real development activity into notes, debugging stories, and product context.",
    imageFit: "contain",
    links: [
      { label: "AutoJack archive", href: "https://drunk.support/category/autojack/" },
      { label: "drunk.support", href: "https://drunk.support/" }
    ]
  },
  {
    name: "Jason Coleman",
    role: "Co-Founder, CEO",
    company: "Paid Memberships Pro",
    image: "https://www.paidmembershipspro.com/images/Jason_Coleman-256x256.jpg",
    imageAlt: "Jason Coleman",
    href: "https://www.paidmembershipspro.com/about/",
    bio: "Co-Founder and CEO of Paid Memberships Pro, the open source WordPress membership platform from Stranger Studios.",
    links: [
      { label: "Paid Memberships Pro", href: "https://www.paidmembershipspro.com/about/" },
      { label: "Stranger Studios", href: "https://www.strangerstudios.com/" }
    ]
  },
  {
    name: "Flint",
    role: "Automation collaborator",
    company: "Stranger Studios",
    image: "https://avatars.githubusercontent.com/u/267404437?v=4",
    imageAlt: "Flint",
    href: "https://github.com/flintfromthebasement",
    bio: "Helps automate business, marketing, and development processes for Stranger Studios.",
    links: [
      { label: "GitHub", href: "https://github.com/flintfromthebasement" },
      { label: "Website", href: "https://flint.fountain.network/" }
    ]
  },
  {
    name: "Zack Katz",
    role: "Project Lead and Developer",
    company: "GravityKit",
    image: "https://www.gravitykit.com/wp-content/uploads/2025/11/Zack-cc-1024x1024.jpg",
    imageAlt: "Zack Katz",
    href: "https://www.gravitykit.com/about/",
    bio: "Project Lead and Developer at GravityKit, where the team builds tools for extending Gravity Forms into applications and workflows.",
    links: [
      { label: "GravityKit", href: "https://www.gravitykit.com/about/" },
      { label: "katz.co", href: "https://katz.co/" }
    ]
  },
  {
    name: "Daniel Iser",
    role: "Founder",
    company: "Popup Maker",
    image: "https://wppopupmaker.com/wp-content/uploads/Daniels-Headshots-150x150.jpg.webp",
    imageAlt: "Daniel Iser",
    href: "https://wppopupmaker.com/about/",
    bio: "Founder of Popup Maker, focused on conversion tools for WordPress sites and the wider Code Atlantic product family.",
    links: [
      { label: "Popup Maker", href: "https://wppopupmaker.com/about/" },
      { label: "Code Atlantic", href: "https://code-atlantic.com/" }
    ]
  }
];
