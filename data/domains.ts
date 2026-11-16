import type { DomainInfo } from '@/lib/types';

export const DOMAINS: readonly DomainInfo[] = [
  {
    slug: 'space-science-astronomy',
    name: 'Space Science & Astronomy',
    shortName: 'Space Science & Astronomy',
    color: '#8b5cf6',
    description:
      'Astrophysics, exoplanet surveys, cosmology, and deep-sky observatories.',
  },
  {
    slug: 'aerospace-aviation',
    name: 'Aerospace & Aviation',
    shortName: 'Aerospace & Aviation',
    color: '#0ea5e9',
    description:
      'Propulsion engineering, flight testing, aerodynamics, and orbital launch.',
  },
  {
    slug: 'robotics-automation',
    name: 'Robotics & Automation',
    shortName: 'Robotics & Automation',
    color: '#f59e0b',
    description:
      'Autonomous locomotion, dexterous manipulation, and industrial control.',
  },
  {
    slug: 'ai-machine-learning',
    name: 'AI & Machine Learning',
    shortName: 'AI & Machine Learning',
    color: '#4d7cff',
    description:
      'Foundation models, scientific computing, and neural architectures.',
  },
  {
    slug: 'electronics-embedded-systems',
    name: 'Electronics & Embedded Systems',
    shortName: 'Electronics & Embedded Systems',
    color: '#10b981',
    description:
      'Semiconductors, FPGA design, RISC-V silicon, and embedded hardware.',
  },
  {
    slug: 'scientific-instruments',
    name: 'Scientific Instruments',
    shortName: 'Scientific Instruments',
    color: '#06b6d4',
    description:
      'Particle detectors, spectroscopy, metrology, and precision sensors.',
  },
  {
    slug: 'space-agencies',
    name: 'NASA, ISRO & Global Space Agencies',
    shortName: 'NASA, ISRO & Global Space Agencies',
    color: '#ec4899',
    description:
      'Official mission updates, planetary exploration, and space agency bulletins.',
  },
  {
    slug: 'scientific-research-journals',
    name: 'Scientific Research & Journals',
    shortName: 'Scientific Research & Journals',
    color: '#6366f1',
    description:
      'Peer-reviewed publications, open preprints, and research archives.',
  },
  {
    slug: 'emerging-stem-innovations',
    name: 'Emerging STEM Innovations',
    shortName: 'Emerging STEM Innovations',
    color: '#f97316',
    description:
      'Quantum engineering, fusion energy, metamaterials, and new patents.',
  },
] as const;
