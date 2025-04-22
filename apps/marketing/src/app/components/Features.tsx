'use client';

import { CodeIcon, ShieldCheckIcon, ChartBarIcon } from './Icons';

export default function Features() {
  const featuresList = [
    {
      icon: <CodeIcon className="w-6 h-6 text-syntropi-blue" />,
      title: "Developer API",
      description: "Build applications faster with our intuitive and fully documented API. Easy to integrate and scale.",
    },
    {
      icon: <ShieldCheckIcon className="w-6 h-6 text-syntropi-blue" />,
      title: "Enterprise Security",
      description: "Industry-leading security with end-to-end encryption, OAuth integration, and compliance with standards.",
    },
    {
      icon: <ChartBarIcon className="w-6 h-6 text-syntropi-blue" />,
      title: "Advanced Analytics",
      description: "Real-time insights into your API usage, performance metrics, and user behavior to optimize operations.",
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-syntropi-blue">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>,
      title: "High Performance",
      description: "Global edge network ensures low-latency responses and high availability for all your API requests.",
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-syntropi-blue">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>,
      title: "Flexible Configuration",
      description: "Customize your API settings and workflows to match your exact business requirements.",
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-syntropi-blue">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>,
      title: "Robust Authentication",
      description: "Multiple authentication methods including API keys, JWT, and OAuth2 to secure your applications.",
    }
  ];

  return (
    <section className="py-24 bg-gray-50" id="features">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Powerful Features for Modern API Development
          </h2>
          <p className="text-lg text-gray-600">
            Everything you need to build, manage, and scale your API infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuresList.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-soft-lavender rounded-lg flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-syntropi-blue rounded-full mr-2"></span>
                    <span className="text-sm text-gray-600">Feature benefit 1</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-syntropi-blue rounded-full mr-2"></span>
                    <span className="text-sm text-gray-600">Feature benefit 2</span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-syntropi-blue rounded-full mr-2"></span>
                    <span className="text-sm text-gray-600">Feature benefit 3</span>
                  </li>
                </ul>
                <button className="text-syntropi-blue font-medium text-sm hover:underline inline-flex items-center">
                  Learn more
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 