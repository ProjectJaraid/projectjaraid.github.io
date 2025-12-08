<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    exclude-result-prefixes="xs"
    version="2.0">
    
    <!-- Output HTML -->
    <xsl:output method="html" indent="yes"/>
    
    <!-- Root template -->
    <xsl:template match="/">
        <html>
            <head>
                <title>Extracted Type Attributes</title>
            </head>
            <body>
                <h1>List of Type Attributes</h1>
                <ul>
                    <!-- Loop through each document -->
                    <xsl:for-each select="collection('path/to/your/documents/*.xml')">
                        <!-- Extract orgname elements -->
                        <xsl:for-each select="//orgname[@type]">
                            <li>
                                <a>
                                    <xsl:attribute name="href"></xsl:attribute>
                                        <xl></xl> </a>
                                            </li>
                                                
    
    
    
    
</xsl:stylesheet>